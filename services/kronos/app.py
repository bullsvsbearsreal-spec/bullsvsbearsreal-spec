"""
Kronos Prediction Service for InfoHub Mk2
==========================================
FastAPI microservice wrapping the Kronos financial time series foundation model.
Accepts historical funding rate / price data and returns forecasts.

Endpoints:
  POST /predict/funding   — Predict future funding rates for a symbol
  POST /predict/spread    — Predict spread direction between two exchanges
  POST /predict/batch     — Batch predictions for multiple symbols
  GET  /health            — Health check
"""

import os
import sys
import time
import logging
from typing import Optional
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add model package to path
sys.path.insert(0, os.path.dirname(__file__))
from model import Kronos, KronosTokenizer, KronosPredictor

logger = logging.getLogger("kronos-service")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Global predictor (loaded once at startup)
# ---------------------------------------------------------------------------
predictor: Optional[KronosPredictor] = None

MODEL_NAME = os.getenv("KRONOS_MODEL", "NeoQuasar/Kronos-small")
TOKENIZER_NAME = os.getenv("KRONOS_TOKENIZER", "NeoQuasar/Kronos-Tokenizer-base")
MAX_CONTEXT = int(os.getenv("KRONOS_MAX_CONTEXT", "512"))
DEVICE = os.getenv("KRONOS_DEVICE", None)  # auto-detect if None
API_KEY = os.getenv("KRONOS_API_KEY", "")  # optional auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, cleanup on shutdown."""
    global predictor
    logger.info(f"Loading Kronos model: {MODEL_NAME}")
    logger.info(f"Loading tokenizer: {TOKENIZER_NAME}")
    t0 = time.time()

    tokenizer = KronosTokenizer.from_pretrained(TOKENIZER_NAME)
    model = Kronos.from_pretrained(MODEL_NAME)
    predictor = KronosPredictor(model, tokenizer, device=DEVICE, max_context=MAX_CONTEXT)

    device_used = predictor.device
    logger.info(f"Kronos loaded in {time.time() - t0:.1f}s on {device_used}")
    yield
    logger.info("Kronos service shutting down")


app = FastAPI(
    title="Kronos Prediction Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth middleware (optional)
# ---------------------------------------------------------------------------
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if API_KEY and request.url.path != "/health":
            auth = request.headers.get("Authorization", "")
            if auth != f"Bearer {API_KEY}":
                return HTTPException(status_code=401, detail="Unauthorized")
        return await call_next(request)

if API_KEY:
    app.add_middleware(AuthMiddleware)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class FundingRatePoint(BaseModel):
    """A single funding rate observation."""
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    rate: float = Field(..., description="Funding rate as percentage (e.g., 0.01 = 0.01%)")


class FundingPredictionRequest(BaseModel):
    """Request to predict future funding rates."""
    symbol: str
    exchange: str
    history: list[FundingRatePoint] = Field(..., min_length=24, description="Historical funding rates (min 24 points)")
    pred_steps: int = Field(default=12, ge=1, le=96, description="Number of future periods to predict")
    interval_hours: float = Field(default=8, description="Hours between each funding rate observation")
    temperature: float = Field(default=0.8, ge=0.1, le=2.0)
    sample_count: int = Field(default=3, ge=1, le=10, description="Samples to average for prediction")


class FundingPredictionPoint(BaseModel):
    timestamp: str
    predicted_rate: float
    confidence: float = Field(description="0-1 confidence based on prediction variance")


class FundingPredictionResponse(BaseModel):
    symbol: str
    exchange: str
    predictions: list[FundingPredictionPoint]
    trend: str = Field(description="'rising' | 'falling' | 'stable'")
    avg_predicted_rate: float
    model: str
    inference_ms: int


class SpreadPredictionRequest(BaseModel):
    """Request to predict spread direction between two exchanges."""
    symbol: str
    high_exchange: str
    low_exchange: str
    high_history: list[FundingRatePoint] = Field(..., min_length=24)
    low_history: list[FundingRatePoint] = Field(..., min_length=24)
    pred_steps: int = Field(default=12, ge=1, le=96)
    interval_hours: float = Field(default=8)
    temperature: float = Field(default=0.8)
    sample_count: int = Field(default=3, ge=1, le=10)


class SpreadPredictionResponse(BaseModel):
    symbol: str
    high_exchange: str
    low_exchange: str
    current_spread: float
    predicted_spread: float
    spread_direction: str  # 'widening' | 'narrowing' | 'stable'
    spread_change_pct: float
    confidence: float
    high_predictions: list[FundingPredictionPoint]
    low_predictions: list[FundingPredictionPoint]
    model: str
    inference_ms: int


class BatchItem(BaseModel):
    symbol: str
    exchange: str
    history: list[FundingRatePoint] = Field(..., min_length=24)


class BatchPredictionRequest(BaseModel):
    items: list[BatchItem] = Field(..., max_length=50)
    pred_steps: int = Field(default=12, ge=1, le=96)
    interval_hours: float = Field(default=8)
    temperature: float = Field(default=0.8)
    sample_count: int = Field(default=3, ge=1, le=10)


class BatchPredictionItem(BaseModel):
    symbol: str
    exchange: str
    predictions: list[FundingPredictionPoint]
    trend: str
    avg_predicted_rate: float


class BatchPredictionResponse(BaseModel):
    results: list[BatchPredictionItem]
    model: str
    inference_ms: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def funding_to_ohlcv(history: list[FundingRatePoint], interval_hours: float) -> tuple[pd.DataFrame, pd.Series]:
    """
    Transform funding rate time series into pseudo-OHLCV format for Kronos.

    Strategy: treat the funding rate as a 'price' series. Since Kronos expects
    OHLCV data, we create synthetic OHLC from the rate values:
      - open/close = the rate at that timestamp
      - high = rate + small noise (simulates intra-period variation)
      - low  = rate - small noise

    This preserves the time series dynamics that Kronos was trained on.
    """
    timestamps = pd.to_datetime([p.timestamp for p in history])
    rates = np.array([p.rate for p in history], dtype=np.float64)

    # Scale rates to a price-like range for better tokenizer behavior
    # Kronos was trained on prices ($10-$100K range), so we scale rates
    # to a reasonable price-like domain while preserving relative changes
    rate_mean = np.mean(rates)
    rate_std = np.std(rates) + 1e-8

    # Map to synthetic price range centered around 100
    # This is just for the model's tokenizer — we reverse-transform the output
    base_price = 100.0
    price_scale = 10.0  # 1 std of rates = $10 price move
    synthetic_prices = base_price + (rates - rate_mean) / rate_std * price_scale

    # Create OHLC with small intra-bar variation
    noise_scale = 0.002  # 0.2% noise
    noise_h = np.abs(np.random.normal(0, noise_scale, len(rates))) * synthetic_prices
    noise_l = np.abs(np.random.normal(0, noise_scale, len(rates))) * synthetic_prices

    df = pd.DataFrame({
        'open': synthetic_prices,
        'high': synthetic_prices + noise_h,
        'low': synthetic_prices - noise_l,
        'close': synthetic_prices,
    })

    return df, timestamps, rate_mean, rate_std, base_price, price_scale


def ohlcv_to_funding(pred_df: pd.DataFrame, rate_mean: float, rate_std: float,
                     base_price: float, price_scale: float) -> np.ndarray:
    """Reverse-transform predicted OHLCV back to funding rates."""
    predicted_prices = pred_df['close'].values
    predicted_rates = (predicted_prices - base_price) / price_scale * rate_std + rate_mean
    return predicted_rates


def generate_future_timestamps(last_ts: pd.Timestamp, pred_steps: int, interval_hours: float) -> pd.Series:
    """Generate future timestamps for predictions."""
    delta = pd.Timedelta(hours=interval_hours)
    future = [last_ts + delta * (i + 1) for i in range(pred_steps)]
    return pd.Series(pd.DatetimeIndex(future))


def compute_confidence(pred_rates: np.ndarray, historical_std: float) -> list[float]:
    """
    Compute confidence scores for predictions.
    Confidence decreases with prediction horizon and rate of change.
    """
    confidences = []
    for i, rate in enumerate(pred_rates):
        # Base confidence decays with horizon
        horizon_decay = max(0.3, 1.0 - (i * 0.05))
        # Penalize extreme predictions
        if historical_std > 0:
            deviation = abs(rate - pred_rates[0]) / (historical_std + 1e-8)
            deviation_penalty = max(0.2, 1.0 - deviation * 0.15)
        else:
            deviation_penalty = 0.5
        conf = min(1.0, horizon_decay * deviation_penalty)
        confidences.append(round(conf, 3))
    return confidences


def classify_trend(rates: np.ndarray) -> str:
    """Classify rate trend as rising/falling/stable."""
    if len(rates) < 2:
        return "stable"
    first_half = np.mean(rates[:len(rates)//2])
    second_half = np.mean(rates[len(rates)//2:])
    change = second_half - first_half
    threshold = np.std(rates) * 0.3 if np.std(rates) > 0 else 0.001
    if change > threshold:
        return "rising"
    elif change < -threshold:
        return "falling"
    return "stable"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "device": predictor.device if predictor else "not loaded",
        "ready": predictor is not None,
    }


@app.post("/predict/funding", response_model=FundingPredictionResponse)
async def predict_funding(req: FundingPredictionRequest):
    if predictor is None:
        raise HTTPException(503, "Model not loaded")

    t0 = time.time()

    try:
        # Transform funding rates → pseudo-OHLCV
        df, timestamps, rate_mean, rate_std, base_price, price_scale = funding_to_ohlcv(
            req.history, req.interval_hours
        )

        # Generate future timestamps
        y_timestamps = generate_future_timestamps(timestamps.iloc[-1], req.pred_steps, req.interval_hours)

        # Run Kronos prediction
        pred_df = predictor.predict(
            df=df,
            x_timestamp=timestamps,
            y_timestamp=y_timestamps,
            pred_len=req.pred_steps,
            T=req.temperature,
            top_p=0.9,
            sample_count=req.sample_count,
            verbose=False,
        )

        # Reverse-transform to funding rates
        predicted_rates = ohlcv_to_funding(pred_df, rate_mean, rate_std, base_price, price_scale)
        hist_std = np.std([p.rate for p in req.history])
        confidences = compute_confidence(predicted_rates, hist_std)

        predictions = [
            FundingPredictionPoint(
                timestamp=y_timestamps.iloc[i].isoformat(),
                predicted_rate=round(float(predicted_rates[i]), 6),
                confidence=confidences[i],
            )
            for i in range(len(predicted_rates))
        ]

        return FundingPredictionResponse(
            symbol=req.symbol,
            exchange=req.exchange,
            predictions=predictions,
            trend=classify_trend(predicted_rates),
            avg_predicted_rate=round(float(np.mean(predicted_rates)), 6),
            model=MODEL_NAME,
            inference_ms=int((time.time() - t0) * 1000),
        )

    except Exception as e:
        logger.error(f"Prediction failed for {req.symbol}/{req.exchange}: {e}")
        raise HTTPException(500, f"Prediction failed: {str(e)}")


@app.post("/predict/spread", response_model=SpreadPredictionResponse)
async def predict_spread(req: SpreadPredictionRequest):
    if predictor is None:
        raise HTTPException(503, "Model not loaded")

    t0 = time.time()

    try:
        # Predict both sides
        df_high, ts_high, mean_h, std_h, bp_h, ps_h = funding_to_ohlcv(req.high_history, req.interval_hours)
        df_low, ts_low, mean_l, std_l, bp_l, ps_l = funding_to_ohlcv(req.low_history, req.interval_hours)

        y_timestamps = generate_future_timestamps(ts_high.iloc[-1], req.pred_steps, req.interval_hours)

        # Batch predict both exchange histories together
        pred_dfs = predictor.predict_batch(
            df_list=[df_high, df_low],
            x_timestamp_list=[ts_high, ts_low],
            y_timestamp_list=[y_timestamps, y_timestamps],
            pred_len=req.pred_steps,
            T=req.temperature,
            top_p=0.9,
            sample_count=req.sample_count,
            verbose=False,
        )

        high_rates = ohlcv_to_funding(pred_dfs[0], mean_h, std_h, bp_h, ps_h)
        low_rates = ohlcv_to_funding(pred_dfs[1], mean_l, std_l, bp_l, ps_l)

        # Current and predicted spreads
        current_spread = req.high_history[-1].rate - req.low_history[-1].rate
        avg_predicted_spread = float(np.mean(high_rates - low_rates))

        spread_change = avg_predicted_spread - current_spread
        spread_change_pct = (spread_change / (abs(current_spread) + 1e-8)) * 100

        # Direction classification
        if spread_change_pct > 10:
            direction = "widening"
        elif spread_change_pct < -10:
            direction = "narrowing"
        else:
            direction = "stable"

        # Overall confidence
        spread_confidence = max(0.2, min(1.0, 1.0 - abs(spread_change_pct) * 0.005))

        hist_std_h = np.std([p.rate for p in req.high_history])
        hist_std_l = np.std([p.rate for p in req.low_history])
        conf_h = compute_confidence(high_rates, hist_std_h)
        conf_l = compute_confidence(low_rates, hist_std_l)

        high_predictions = [
            FundingPredictionPoint(
                timestamp=y_timestamps.iloc[i].isoformat(),
                predicted_rate=round(float(high_rates[i]), 6),
                confidence=conf_h[i],
            )
            for i in range(len(high_rates))
        ]
        low_predictions = [
            FundingPredictionPoint(
                timestamp=y_timestamps.iloc[i].isoformat(),
                predicted_rate=round(float(low_rates[i]), 6),
                confidence=conf_l[i],
            )
            for i in range(len(low_rates))
        ]

        return SpreadPredictionResponse(
            symbol=req.symbol,
            high_exchange=req.high_exchange,
            low_exchange=req.low_exchange,
            current_spread=round(current_spread, 6),
            predicted_spread=round(avg_predicted_spread, 6),
            spread_direction=direction,
            spread_change_pct=round(spread_change_pct, 2),
            confidence=round(spread_confidence, 3),
            high_predictions=high_predictions,
            low_predictions=low_predictions,
            model=MODEL_NAME,
            inference_ms=int((time.time() - t0) * 1000),
        )

    except Exception as e:
        logger.error(f"Spread prediction failed for {req.symbol}: {e}")
        raise HTTPException(500, f"Spread prediction failed: {str(e)}")


@app.post("/predict/batch", response_model=BatchPredictionResponse)
async def predict_batch(req: BatchPredictionRequest):
    if predictor is None:
        raise HTTPException(503, "Model not loaded")

    t0 = time.time()

    try:
        df_list = []
        ts_list = []
        transform_params = []

        for item in req.items:
            df, timestamps, rate_mean, rate_std, base_price, price_scale = funding_to_ohlcv(
                item.history, req.interval_hours
            )
            df_list.append(df)
            ts_list.append(timestamps)
            transform_params.append((rate_mean, rate_std, base_price, price_scale))

        y_timestamps = generate_future_timestamps(ts_list[0].iloc[-1], req.pred_steps, req.interval_hours)
        y_ts_list = [y_timestamps] * len(req.items)

        pred_dfs = predictor.predict_batch(
            df_list=df_list,
            x_timestamp_list=ts_list,
            y_timestamp_list=y_ts_list,
            pred_len=req.pred_steps,
            T=req.temperature,
            top_p=0.9,
            sample_count=req.sample_count,
            verbose=False,
        )

        results = []
        for i, item in enumerate(req.items):
            mean, std, bp, ps = transform_params[i]
            predicted_rates = ohlcv_to_funding(pred_dfs[i], mean, std, bp, ps)
            hist_std = np.std([p.rate for p in item.history])
            confidences = compute_confidence(predicted_rates, hist_std)

            predictions = [
                FundingPredictionPoint(
                    timestamp=y_timestamps.iloc[j].isoformat(),
                    predicted_rate=round(float(predicted_rates[j]), 6),
                    confidence=confidences[j],
                )
                for j in range(len(predicted_rates))
            ]

            results.append(BatchPredictionItem(
                symbol=item.symbol,
                exchange=item.exchange,
                predictions=predictions,
                trend=classify_trend(predicted_rates),
                avg_predicted_rate=round(float(np.mean(predicted_rates)), 6),
            ))

        return BatchPredictionResponse(
            results=results,
            model=MODEL_NAME,
            inference_ms=int((time.time() - t0) * 1000),
        )

    except Exception as e:
        logger.error(f"Batch prediction failed: {e}")
        raise HTTPException(500, f"Batch prediction failed: {str(e)}")

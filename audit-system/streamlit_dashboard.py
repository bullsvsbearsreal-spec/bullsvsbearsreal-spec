#!/usr/bin/env python3
"""
Streamlit Dashboard — Visual audit results viewer.

Usage:
    streamlit run streamlit_dashboard.py
    # or via the main script:
    python dashboard_auditor.py --streamlit
"""

import glob
import json
import os

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd

REPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audit_reports")


def load_latest_report() -> dict | None:
    """Load the most recent audit JSON report."""
    pattern = os.path.join(REPORT_DIR, "audit_*.json")
    files = sorted(glob.glob(pattern), reverse=True)
    if not files:
        return None
    with open(files[0], "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    st.set_page_config(
        page_title="InfoHub Audit Dashboard",
        page_icon="🔍",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    # Dark theme styling
    st.markdown("""
    <style>
        .stApp { background-color: #0a0a0f; }
        .metric-card { background: #12121f; border: 1px solid #1a1a2e; border-radius: 12px;
                       padding: 20px; text-align: center; }
        .metric-value { font-size: 36px; font-weight: 700; }
        .metric-label { font-size: 12px; color: #888; text-transform: uppercase; }
    </style>
    """, unsafe_allow_html=True)

    st.title("InfoHub Dashboard Audit Results")

    data = load_latest_report()
    if not data:
        st.error(f"No audit reports found in {REPORT_DIR}. Run `python dashboard_auditor.py` first.")
        return

    agents = data.get("agents", [])
    supervisor = data.get("supervisor", {})
    timestamp = data.get("timestamp", "unknown")

    st.caption(f"Report generated: {timestamp} | {len(agents)} pages audited")

    # ─── Top-level metrics ───────────────────────────────────────────
    sup_score = supervisor.get("score", {})

    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("Overall", f"{sup_score.get('overall', 0)}/10")
    col2.metric("UI/UX", f"{sup_score.get('ui_ux', 0)}/10")
    col3.metric("Data Accuracy", f"{sup_score.get('data_accuracy', 0)}/10")
    col4.metric("Real-time", f"{sup_score.get('real_time', 0)}/10")
    col5.metric("Bug Risk", f"{sup_score.get('bug_risk', 0)}/10")

    total_bugs = sum(len(a.get("bugs_found", [])) for a in agents)
    total_security = sum(len(a.get("security_issues", [])) for a in agents)
    total_proposals = sum(len(a.get("improvement_proposals", [])) for a in agents)

    col6, col7, col8 = st.columns(3)
    col6.metric("Bugs Found", total_bugs, delta_color="inverse")
    col7.metric("Security Issues", total_security, delta_color="inverse")
    col8.metric("Improvements", total_proposals)

    st.divider()

    # ─── Scoreboard ──────────────────────────────────────────────────
    st.subheader("Scoreboard")

    if agents:
        df = pd.DataFrame([
            {
                "Page": a["page_name"],
                "Category": a["category"],
                "UI/UX": a["score"]["ui_ux"],
                "Data": a["score"]["data_accuracy"],
                "RT": a["score"]["real_time"],
                "Bugs": a["score"]["bug_risk"],
                "Overall": a["score"]["overall"],
                "Duration (s)": a["duration_seconds"],
            }
            for a in agents
        ])
        df = df.sort_values("Overall", ascending=True)

        # Radar chart for each category
        categories = ["UI/UX", "Data", "RT", "Bugs"]
        fig_radar = go.Figure()

        for _, row in df.iterrows():
            fig_radar.add_trace(go.Scatterpolar(
                r=[row["UI/UX"], row["Data"], row["RT"], row["Bugs"]],
                theta=categories,
                fill='toself',
                name=row["Page"],
                opacity=0.6,
            ))

        fig_radar.update_layout(
            polar=dict(radialaxis=dict(visible=True, range=[0, 10])),
            showlegend=True,
            template="plotly_dark",
            height=500,
            title="Score Radar — All Pages",
        )
        st.plotly_chart(fig_radar, use_container_width=True)

        # Bar chart — overall scores
        fig_bar = px.bar(
            df, x="Page", y="Overall",
            color="Overall",
            color_continuous_scale=["#f44336", "#ff9800", "#4caf50"],
            range_color=[1, 10],
            template="plotly_dark",
            title="Overall Score by Page",
        )
        fig_bar.update_layout(height=400)
        st.plotly_chart(fig_bar, use_container_width=True)

        # Data table
        st.dataframe(
            df.style.background_gradient(subset=["UI/UX", "Data", "RT", "Bugs", "Overall"], cmap="RdYlGn", vmin=1, vmax=10),
            use_container_width=True,
            hide_index=True,
        )

    st.divider()

    # ─── Per-page deep dive ──────────────────────────────────────────
    st.subheader("Page Deep Dive")

    page_names = [a["page_name"] for a in agents]
    selected = st.selectbox("Select page", page_names)

    if selected:
        agent_data = next((a for a in agents if a["page_name"] == selected), None)
        if agent_data:
            col_a, col_b = st.columns(2)

            with col_a:
                st.markdown(f"**Agent:** `{agent_data['agent_id']}`")
                st.markdown(f"**Category:** {agent_data['category']}")
                st.markdown(f"**Duration:** {agent_data['duration_seconds']}s")
                st.markdown(f"**State:** {agent_data['state']}")

                # Score breakdown
                score = agent_data["score"]
                fig_gauge = go.Figure(go.Indicator(
                    mode="gauge+number",
                    value=score["overall"],
                    title={"text": "Overall Score"},
                    gauge={
                        "axis": {"range": [0, 10]},
                        "bar": {"color": "#4caf50" if score["overall"] >= 7 else "#ff9800"},
                        "steps": [
                            {"range": [0, 4], "color": "#1a0000"},
                            {"range": [4, 7], "color": "#1a1a00"},
                            {"range": [7, 10], "color": "#001a00"},
                        ],
                    },
                ))
                fig_gauge.update_layout(template="plotly_dark", height=250)
                st.plotly_chart(fig_gauge, use_container_width=True)

            with col_b:
                # Bugs
                bugs = agent_data.get("bugs_found", [])
                if bugs:
                    st.markdown("**Bugs Found:**")
                    for bug in bugs:
                        sev = bug.get("severity", "low")
                        icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "⚪"}.get(sev, "⚪")
                        st.markdown(f"{icon} **[{sev.upper()}]** {bug.get('note', '')}")
                else:
                    st.success("No bugs found!")

                # Security
                security = agent_data.get("security_issues", [])
                if security:
                    st.markdown("**Security Issues:**")
                    for sec in security:
                        st.markdown(f"🔒 **[{sec.get('severity', 'low').upper()}]** {sec.get('note', '')}")

                # Improvements
                proposals = agent_data.get("improvement_proposals", [])
                if proposals:
                    st.markdown("**Improvement Proposals:**")
                    for prop in proposals:
                        st.markdown(f"💡 **{prop.get('title', '')}** — {prop.get('description', '')}")

    st.divider()

    # ─── Cross-Validation ────────────────────────────────────────────
    cross_val = supervisor.get("data_verification", [])
    if cross_val:
        st.subheader("Cross-Validation Results")
        for cv in cross_val:
            severity = cv.get("severity", "info")
            icon = {"critical": "🔴", "high": "🟠", "medium": "🟡"}.get(severity, "ℹ️")
            st.markdown(f"{icon} **{cv.get('finding', '')}** — {cv.get('details', '')}")

    # ─── Fix List ────────────────────────────────────────────────────
    fix_list = supervisor.get("improvement_proposals", [])
    if fix_list:
        st.subheader("Prioritized Fix List")
        fix_df = pd.DataFrame(fix_list[:30])
        if not fix_df.empty:
            st.dataframe(fix_df, use_container_width=True, hide_index=True)

    # Footer
    st.divider()
    st.caption("Generated by the 18-Agent Dashboard Auditor | InfoHub")


if __name__ == "__main__":
    main()

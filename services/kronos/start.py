"""Startup wrapper that adds kronos-src to sys.path before launching uvicorn."""
import sys
import os

# Add the cloned Kronos model package to path
kronos_src = os.path.join(os.path.dirname(__file__), '..', 'kronos-src')
sys.path.insert(0, os.path.abspath(kronos_src))

import uvicorn

if __name__ == '__main__':
    uvicorn.run('app:app', host='0.0.0.0', port=8400, app_dir=os.path.dirname(__file__))

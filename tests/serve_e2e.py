"""Serve disposable learner data for browser checks; never touch real profiles."""
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ['ANTHROPIC_API_KEY'] = ''

import uvicorn
from app import db, feed
from pipeline import db as pipeline_db

if __name__ == '__main__':
    with tempfile.TemporaryDirectory(prefix='garden-browser-') as tmp:
        template = Path(tmp)/'vocab.sqlite'
        with sqlite3.connect(str(ROOT/'data/vocab.sqlite')) as source, sqlite3.connect(str(template)) as destination:
            source.backup(destination)
        db.PROFILES_DIR = Path(tmp)/'profiles'
        pipeline_db.DEFAULT_DB = template
        feed.reflect.recommend_next_topic = lambda *args, **kwargs: None
        uvicorn.run('app.main:app', host='127.0.0.1', port=8001, log_level='warning')

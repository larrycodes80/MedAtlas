"""Run with backend/.venv/Scripts/python backend/test_auth.py."""
import os
import shutil
import tempfile
import gc

vault = tempfile.mkdtemp()
try:
    os.environ["DATA_DIR"] = vault
    from fastapi.testclient import TestClient
    from main import app

    profile = {"name": "Offline Tester", "dateOfBirth": "1990-01-01", "password": "correct horse battery"}
    with TestClient(app) as client:
        assert client.get("/api/sources").status_code == 401
        created = client.post("/api/auth/create", json=profile)
        assert created.status_code == 200, created.text
        user_id = created.json()["profile"]["userId"]
        assert user_id.startswith("usr_")
        assert client.get("/api/auth/status").json()["profile"]["userId"] == user_id
        assert client.get("/api/sources").status_code == 200
        assert client.post("/api/auth/logout").status_code == 200
        assert client.get("/api/sources").status_code == 401
        assert client.post("/api/auth/login", json=profile).status_code == 200
        wrong = {**profile, "password": "wrong password"}
        assert client.post("/api/auth/login", json=wrong).status_code == 401
        second = {**profile, "name": "Another Tester"}
        assert client.post("/api/auth/create", json=second).json()["profile"]["userId"] != user_id
finally:
    gc.collect()
    shutil.rmtree(vault, ignore_errors=True)

print("Offline create, login, logout, unique-user, and wrong-password checks passed.")

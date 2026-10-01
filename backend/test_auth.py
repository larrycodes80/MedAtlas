"""Run with backend/.venv/Scripts/python backend/test_auth.py."""
import os
import tempfile

with tempfile.TemporaryDirectory() as vault:
    os.environ["DATA_DIR"] = vault
    from fastapi.testclient import TestClient
    import pyotp
    from main import app

    profile = {"name": "Offline Tester", "dateOfBirth": "1990-01-01", "mobile": "+919999999999"}
    with TestClient(app) as client:
        assert client.get("/api/sources").status_code == 401
        setup = client.post("/api/auth/enroll", json=profile)
        assert setup.status_code == 200, setup.text
        secret = setup.json()["manualKey"]
        assert setup.json()["qr"].startswith("data:image/png;base64,")
        code = pyotp.TOTP(secret).now()
        assert client.post("/api/auth/activate", json={"code": code}).status_code == 200
        assert client.get("/api/sources").status_code == 200
        assert client.post("/api/auth/enroll", json=profile).status_code == 409
        assert client.post("/api/auth/logout").status_code == 200
        assert client.get("/api/sources").status_code == 401
        assert client.post("/api/auth/login", json={**profile, "code": code}).status_code == 401  # replay
        assert client.post("/api/auth/login", json={**profile, "code": "000000"}).status_code == 401
    import gc
    gc.collect()
    print("Offline enrollment, API gate, logout, and replay checks passed.")

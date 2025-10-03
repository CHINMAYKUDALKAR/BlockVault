import pytest
from blockvault import create_app
from blockvault.core.security import generate_jwt

@pytest.fixture()
def app():
    app = create_app()
    app.config.update(TESTING=True, MONGO_URI="memory://test")
    return app

@pytest.fixture()
def client(app):
    return app.test_client()

def test_get_nonce_requires_address(client):
    resp = client.post('/auth/get_nonce', json={})
    assert resp.status_code == 400


def test_get_nonce_success(client):
    resp = client.post('/auth/get_nonce', json={'address': '0x0000000000000000000000000000000000000000'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'nonce' in data
    assert data['address'].startswith('0x')


def test_me_requires_auth(client):
    resp = client.get('/auth/me')
    assert resp.status_code == 401


def test_me_with_valid_token(client):
    # Directly generate token (bypassing signature flow) for unit test
    with client.application.app_context():
        token = generate_jwt({"sub": "0xabcDEF0000000000000000000000000000000000"})
    resp = client.get('/auth/me', headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['address'].lower() == '0xabcdef0000000000000000000000000000000000'

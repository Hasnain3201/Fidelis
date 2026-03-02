from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from app.core.config import settings
from app.core.jwks import verify_supabase_jwt

bearer = HTTPBearer()


def require_user_id(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    token = credentials.credentials

    try:
        payload = verify_supabase_jwt(token)
        sub = payload.get("sub")
        if not isinstance(sub, str) or not sub:
            raise ValueError("Missing sub")
        return sub
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def require_role(required_role: str):
    def _role_dependency(user_id: str = Depends(require_user_id)):
        return user_id  
    
    return _role_dependency
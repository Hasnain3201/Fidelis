from typing import Optional

from fastapi import Header, HTTPException, status


def require_user_id(x_user_id: Optional[str] = Header(default=None)) -> str:
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Id header (placeholder auth)",
        )
    return x_user_id


def require_role(required_role: str):
    def _role_dependency(x_user_role: Optional[str] = Header(default=None)) -> str:
        if x_user_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role}' required (placeholder auth)",
            )
        return x_user_role

    return _role_dependency

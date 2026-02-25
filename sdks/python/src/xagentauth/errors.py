class AgentAuthError(Exception):
    def __init__(self, message: str, status: int = 0, error_type: str | None = None):
        super().__init__(message)
        self.status = status
        self.error_type = error_type

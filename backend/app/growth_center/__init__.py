"""Growth Center — isolated Super Admin business-development workspace.

SECURITY BOUNDARY: this package must never import operational application
code. The ONLY approved dependency on the main application is
`app.core.security` (authentication + role verification). Storage lives in a
dedicated MongoDB database configured via GROWTH_CENTER_MONGO_URI with no
fallback to the operational database. tests/test_growth_center.py enforces
the import boundary.
"""

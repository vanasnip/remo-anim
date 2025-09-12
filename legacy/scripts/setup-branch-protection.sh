#!/bin/bash

# Branch Protection Setup Script
# Configure GitHub branch protection rules via API

set -e

REPO_OWNER=$(git config --get remote.origin.url | sed -n 's/.*github.com[:\/]\([^\/]*\).*/\1/p')
REPO_NAME=$(basename -s .git `git config --get remote.origin.url`)

echo "🔒 Setting up branch protection for $REPO_OWNER/$REPO_NAME"

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN environment variable not set"
    echo "Please set: export GITHUB_TOKEN=your_github_token"
    exit 1
fi

configure_branch_protection() {
    local branch=$1
    echo "Configuring protection for branch: $branch"

    curl -X PUT \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/branches/$branch/protection" \
        -d '{
            "required_status_checks": {
                "strict": true,
                "contexts": [
                    "pre-commit",
                    "test-remotion",
                    "security-scan"
                ]
            },
            "enforce_admins": false,
            "required_pull_request_reviews": {
                "dismissal_restrictions": {},
                "dismiss_stale_reviews": true,
                "require_code_owner_reviews": false,
                "required_approving_review_count": 1,
                "require_last_push_approval": false
            },
            "restrictions": null,
            "allow_force_pushes": false,
            "allow_deletions": false,
            "required_conversation_resolution": true,
            "lock_branch": false,
            "allow_fork_syncing": false
        }'
}

# Configure main branch
configure_branch_protection "main"

# Configure develop branch if it exists
if git show-ref --verify --quiet refs/heads/develop; then
    configure_branch_protection "develop"
fi

echo "✅ Branch protection rules configured successfully!"

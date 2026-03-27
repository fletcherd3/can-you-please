# can you please
A simple CLI tool to help you run day-to-day tasks. Just ask nicely!

## Installation
```bash
npm install -g @zip/can-you-please
```

## Usage
```bash
# List available flows
can-you-please list-flows

# Run a flow in sandbox environment
can-you-please create-user --in sand

# Run with custom variables
can-you-please create-user --in dev --with first-name=John last-name=Doe

# Debug mode (verbose output)
can-you-please create-user --in dev --debug

# Update to latest version
can-you-please pull-flows
```

## Collection 3 Repos
This CLI reads Postman Collection 3 files from your own git-connected repo that contains `postman/collections/`.

## Setup
Run `can-you-please setup` and enter the path to your Collection 3 repo. The CLI stores that path in `~/.can-you-please/config.json`.

## Adding New Flows
1. Create or edit your flow in Postman using Collection 3 files
2. Save or sync the changes into your repo's `postman/collections/`, where each collection folder is treated as a flow
3. Add or update matching environments in your repo's `postman/environments/` when needed

## Development
```bash
# Setup
nvm use
npm install

# Run locally
npm run start

# Link for local testing
npm link
```

## Environment Variables
- `GITLAB_TOKEN` - Required for publishing

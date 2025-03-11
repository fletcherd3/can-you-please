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

## Adding New Flows
1. Create/edit your flow in Postman
2. Export the collection to `src/cyp/`
3. Update the collection reference in `src/index.js`

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
# can you please
a simple cli tool to help you run day to day tasks. just ask nicely!

## Usage
```bash
# create a test user in sand
can-you-please create-user -in sand

# checkout what else you can ask
can-you-please -h
```

## Setup
```bash
# install postman cli
# https://learning.postman.com/docs/postman-cli/postman-cli-installation/
curl -o- "https://dl-cli.pstmn.io/install/osx_arm64.sh" | sh
postman login --with-api-key <postman-api-key> # you'll need mine, ask me (fletcher)

chmod +x can-you-please
ln -s $(pwd)/can-you-please /usr/local/bin/can-you-please

# done!
```
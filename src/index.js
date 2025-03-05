#! /usr/bin/env node

const {program} = require('commander');
const newman = require('newman');
const process = require('process');
const utils = require('./utils.js');
const os = require('os');

const version = require('../package.json').version;
const collection = require('./cyp/cyp.postman_collection.json');
const environmentDev = require('./cyp/env/cyp_dev.postman_environment.json');
const environmentSand = require('./cyp/env/cyp_sand.postman_environment.json');
let globals = require('./cyp/env/workspace.postman_globals.json');

const defaultFirstName = os.userInfo().username.replace(/[^a-zA-Z]/g, '')
if (defaultFirstName.length > 0) {
    utils.addOrReplaceVariable(globals, {key: 'first-name', value: defaultFirstName + "s"});
    utils.addOrReplaceVariable(globals, {key: 'last-name', value: 'test-user'});
}

process.removeAllListeners('warning');

program
    .version(version)
    .description('A helpful assistant. Just ask nicely!')
    .usage(`list-flows --in [dev, sand]
  e.g: can-you-please list-flows --in sand

Usage: can-you-please <flow-name> --in [dev, sand] [options]
  e.g: can-you-please create-user --in sand --with product=zip-pay first-name=Fletcher`
    )
    .argument('[list-flows]', 'list all flows')
    .argument('[<flow-name>]', 'a flow to run')
    .option('-l --list-flows', 'list all flows')
    .option('--in <env>', 'specify environment (dev or sand)')
    .option("--with <key=value...>", 'run flow with variables')
    .option('-d --debug', 'print flow details to stdout')
    .parse(process.argv);

const options = program.opts();
const flow = program.args[0];
const environment = options.in === 'sand' ? environmentSand : environmentDev;

// Wrap newman.run in a Promise
function runNewman(config) {
    return new Promise((resolve, reject) => {
        let logs = [];

        newman.run(config)
            .on('start', function (err, args) {
                console.log("thanks for asking nicely! i'll be just a second");
            })
            .on('console', function (err, args) {
                if (err) {
                    return;
                }
                logs.push(args.messages[0]);
            })
            .on('done', function (err, summary) {
                if (err || summary.error) {
                    console.error('\n womp womp :( an error occurred');
                    reject(err || summary.error);
                } else {
                    console.log('\nall done!\n');
                    if (logs.length > 0) {
                        logs.forEach(l => console.log(l));
                    }
                    resolve();
                }
            });
    });
}

// Main execution
async function main() {
    try {
        // Early returns for special cases
        if (flow === 'list-flows' || options.listFlows) {
            console.log(`    ${'Flow name'.padEnd(30)} Description`)
            collection.item.forEach(flow => {
                console.log(`   ${flow.name.padEnd(30)} (${flow.description})`)
            });
            return;
        }

        if (options.in === undefined && flow !== 'list-flows') {
            console.log("error: option '--in <env>' argument missing");
            return;
        }

        // Process variables if they exist
        if (options.with !== undefined) {
            for (const keyValuePair of options.with) {
                const split = keyValuePair.replace(' ', '').split('=');
                if (split.length !== 2) {
                    console.log('womp womp :(\nvariables should follow the format: --with key=value another=one');
                    return;
                }
                const [key, value] = split;
                utils.addOrReplaceVariable(globals, {key: key.toLowerCase(), value});
            }
        }

        // Run newman
        await runNewman({
            collection: collection,
            environment: environment,
            globals: globals,
            folder: flow,
            reporters: [options.debug ? 'cli' : 'progress'],
            reporter: {
                htmlextra: {logs: true},
                cli: {noSummary: true, noBanner: true}
            }
        });
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Execute main function
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
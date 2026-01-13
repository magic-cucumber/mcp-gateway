import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import * as fs from "node:fs";
import {MCPServersConfigurationSchema} from "./validate.js";

const args = yargs(hideBin(process.argv))
    .option('f', {
        alias: 'config-file',
        type: 'string',
        description: 'the file path of the mcpServer.json'
    })
    .option('s', {
        alias: 'config-string',
        type: 'string',
        description: 'the file content of the mcpServer.json'
    })
    .conflicts('f', 's')
    .check((argv) => {
        if (!argv.f && !argv.s) {
            throw new Error('please give us config-string or config-file.');
        }
        return true
    })
    .check((argv) => {
        const result = MCPServersConfigurationSchema.safeParse(JSON.parse(argv.s ?? fs.readFileSync(argv.f ?? '', 'utf-8')))
        if (!result.success) {
            throw new Error(result.error.message);
        }
        return true
    })
    .parseSync();

export const config = MCPServersConfigurationSchema.parse(JSON.parse(args.s ?? fs.readFileSync(args.f ?? '', 'utf-8')))

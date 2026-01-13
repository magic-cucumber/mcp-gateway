import {Ajv, Schema} from "ajv";


const ajv = new Ajv({allErrors: true})
const cache = new Map<any, ValidateFunction<any>>()

export type ValidateFunction<T> = (data: T) => Promise<void>

export const compile = async <T = unknown>(schema: Schema): Promise<ValidateFunction<T>> => {
    if (cache.has(schema)) {
        return cache.get(schema) as ValidateFunction<T>
    }
    const validate = ajv.compile<T>(schema)
    const fun: ValidateFunction<T> = async (data: T) => {
        const valid = validate(data)
        console.error(`validate: ${data}, success: ${valid}`)

        if (!valid) {
            const instancePath = (s: string) => s.replace(/\/(\d+)/g, '[$1]')
                .replace(/\//g, '.')
                .replace(/^\./, '')
            throw new Error(validate.errors?.map(it => `${instancePath(it.instancePath)} ${it.message}`).join(',') ?? 'unknown')
        }
    }
    cache.set(schema, fun)

    return fun
}

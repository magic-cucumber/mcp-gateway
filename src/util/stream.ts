import {Transform} from "node:stream";

export const createPrefixTransform = (prefix: string) => {
    return new Transform({
        transform(chunk, encoding, callback) {
            const content = chunk.toString();
            // 简单的做法：直接加前缀
            // 更严谨的做法：按行分割加前缀，防止多行日志合并在一起
            const prefixed = content
                .split('\n')
                .map((line: string) => line.length > 0 ? `${prefix} ${line}` : line)
                .join('\n');

            this.push(prefixed);
            callback();
        }
    });
};

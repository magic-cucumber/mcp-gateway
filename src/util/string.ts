export const naturalization = (origin: string) => origin
    .replace("\n", "")
    .replace("\r", "")
    .replace("_", "-")
    .replace(".", "-")
    .replace("。", "-")
    .toLowerCase()

export const limit = (origin: string) => {
    const indexFirstDot = origin.indexOf(".")
    const indexFirstLine = origin.indexOf("\n")
    const indexFirstChineseDot = origin.indexOf("。")

    return origin.substring(0, Math.min(...[indexFirstChineseDot, indexFirstDot, indexFirstLine, 50, origin.length].filter(it => it > 0)))
}

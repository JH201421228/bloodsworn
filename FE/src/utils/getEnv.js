function getEnv(key) {
    const value = import.meta.env[`VITE_${key}`];
    if (typeof value === "undefined") {
        throw new Error(`Environment variable VITE_${key} is not defined`);
    }
    return value;
}

export default getEnv;

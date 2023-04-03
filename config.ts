require("dotenv").config();

class ConfigService {
	constructor(private env: { [k: string]: string | undefined }) {}

	public getValue(key: string, throwOnMissing = true): string {
		const value = this.env[key] || "";
		if (!value && throwOnMissing) {
			throw new Error(`config error - missing env.${key}`);
		}

		return value;
	}

	public ensureValues(keys: string[]) {
		keys.forEach((k) => this.getValue(k, true));
		return this;
	}
}

const requiredConfig = [
	"PRIVATE_KEY",
	"MAINNET_RPC",
	"TESTNET_RPC",
	// "CONTRACT_OWNER",
];

const configService = new ConfigService(process.env).ensureValues(
	requiredConfig
);

export { configService };

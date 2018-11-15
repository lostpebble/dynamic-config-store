import { ConfigStore, ETypeOfEnvLink } from "../../src";

interface ISimpleServerConfig {
  isProductionEnv: boolean;
  serverSecret: string;
  instance: {
    port: number;
    host: {
      protocol: string;
      hostname: string;
    };
  };
}

const createConfig = () =>
  new ConfigStore<ISimpleServerConfig>({
    isProductionEnv: false,
    serverSecret: "123abc",
    instance: {
      port: 8080,
      host: {
        protocol: "http",
        hostname: "localhost",
      },
    },
  });

const createNamedConfig = () =>
  new ConfigStore<ISimpleServerConfig>({
    isProductionEnv: false,
    serverSecret: "123abc",
    instance: {
      port: 8080,
      host: {
        protocol: "http",
        hostname: "localhost",
      },
    },
  }, "OVERRIDE_CONFIG_SERVER_", "Server Config");

describe("Code used in the Readme.md", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  it("Can create the config", () => {
    const config = createConfig();
    expect(config.getConfig()).toMatchSnapshot();
  });

  it("Can react to NODE_ENV", () => {
    process.env.NODE_ENV = "production";

    const config = createConfig();
    config.setEnvLinks({
      isProductionEnv: {
        env: "NODE_ENV",
        type: ETypeOfEnvLink.FUNCTION,
        func: v => v === "production",
        required: true,
      },
    });

    expect(config.getConfig()).toMatchSnapshot();
    process.env.NODE_ENV = "development";

    config.setEnvLinks({
      isProductionEnv: {
        env: "NODE_ENV",
        type: ETypeOfEnvLink.FUNCTION,
        func: v => v === "production",
        required: true,
      },
    });

    expect(config.getConfig().isProductionEnv).toBe(false);
  });

  it("Works as expected with the example", () => {
    process.env.NODE_ENV = "production";

    const config = createConfig();
    config.setEnvLinks({
      isProductionEnv: {
        env: "NODE_ENV",
        type: ETypeOfEnvLink.FUNCTION,
        func: v => v === "production",
      },
      instance: {
        port: {
          env: "SERVER_PORT",
          type: ETypeOfEnvLink.NUMBER,
          required: false
        },
        host: {
          hostname: {
            required: false,
            env: "SERVER_HOST_NAME",
            type: ETypeOfEnvLink.STRING,
            defaultValue: "example.com"
          }
        }
      },
    });

    expect (config.getConfig()).toMatchSnapshot();

    process.env.CONFIG_OVERRIDE_INSTANCE__PORT = "6000";

    config.setConfig({
      serverSecret: "my-new-secret",
      instance: {
        port: 3000,
      },
    });

    expect (config.getConfig()).toMatchSnapshot();
    expect (config.getConfig({ ignoreOverrides: true })).toMatchSnapshot();

    process.env.NODE_ENV = "development";

    config.setEnvLinks({
      isProductionEnv: {
        env: "NODE_ENV",
        type: ETypeOfEnvLink.FUNCTION,
        func: v => v === "production",
      },
    });

    config.addConfigChangeReaction((config) => {
      if (!config.isProductionEnv) {
        config.serverSecret = "dev_secret";
      }
    });

    expect(config.getConfig().serverSecret).toEqual("dev_secret");
  });
});

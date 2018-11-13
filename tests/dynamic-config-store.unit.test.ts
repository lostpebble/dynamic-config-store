import { ConfigStore, ETypeOfEnvLink } from "../src/dynamic-config-store";

interface ISimpleConfig {
  wins: number;
  accessCode: string;
  nullThing: any;
  SomeLibrary: {
    Deeper: {
      key: string;
      otherKey: string;
    }
  }
}

describe("Config Utils", () => {
  describe("A simple config", () => {
    const config = new ConfigStore<ISimpleConfig>({
      accessCode: "123abc",
      nullThing: null,
      SomeLibrary: {
        Deeper: {
          key: "asdasd",
          otherKey: "123123",
        }
      },
      wins: 213,
    });

    it("Should create a simple config (check with and without overrides)", () => {
      expect(config.getConfig({ ignoreOverrides: true })).toMatchObject({
        accessCode: "123abc",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "asdasd",
            otherKey: "123123",
          }
        },
        wins: 213,
      } as ISimpleConfig);

      expect(config.getConfig()).toMatchObject({
        accessCode: "123abc",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "asdasd",
            otherKey: "123123",
          }
        },
        wins: 213,
      } as ISimpleConfig);

      expect(config.getConfig({ ignoreOverrides: true }).SomeLibrary.Deeper.key).toEqual("asdasd");
      expect(config.getConfig().SomeLibrary.Deeper.key).toEqual("asdasd");
    });

    it("Should NOT give an error message for accessing an empty but defined value if we pass the correct parameter", () => {
      const something = config.getConfig().nullThing;
      expect(something).toEqual(null);
    });

    it("Should have an empty overrides object when nothing is overridden", () => {
      const overrides = config.getOverrides();
      expect(overrides).toEqual({
        SomeLibrary: {
          Deeper: {},
        }
      });
    });
  });

  describe("A Config with some overrides", () => {
    process.env.CONFIG_OVERRIDE_ACCESS_CODE = "\"321cba\"";
    process.env.CONFIG_OVERRIDE_SOME_LIBRARY__DEEPER__KEY = "\"dsadsa\"";

    const config = new ConfigStore<ISimpleConfig>({
      accessCode: "123abc",
      nullThing: null,
      SomeLibrary: {
        Deeper: {
          key: "asdasd",
          otherKey: "123123",
        }
      },
      wins: 213,
    });

    it("Should have some overrides", () => {
      expect(config.getOverrides()).toEqual({
        accessCode: "321cba",
        SomeLibrary: {
          Deeper: {
            key: "dsadsa",
          },
        }
      });

      expect(config.getConfig()).toEqual({
        accessCode: "321cba",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "dsadsa",
            otherKey: "123123",
          }
        },
        wins: 213,
      });
    });

    it("Should ignore overrides if asked to", () => {
      expect(config.getConfig()).toEqual({
        accessCode: "321cba",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "dsadsa",
            otherKey: "123123",
          }
        },
        wins: 213,
      });

      expect(config.getConfig({ ignoreOverrides: true })).toEqual({
        accessCode: "123abc",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "asdasd",
            otherKey: "123123",
          }
        },
        wins: 213,
      });
    });

    it("Should throw an error if override isn't JSON parsable", () => {
      process.env.CONFIG_OVERRIDE_ACCESS_CODE = "321cba";

      expect(() => {
        config.setEnvOverridePrefix("CONFIG_OVERRIDE_");
      }).toThrowError();
    });

    it("Should be able to change override prefixes", () => {
      process.env.NEW_CONFIG_PREFIX_ACCESS_CODE = "444444";

      config.setEnvOverridePrefix("NEW_CONFIG_PREFIX_");
      expect(config.getOverrides()).toEqual({
        accessCode: 444444,
        SomeLibrary: {
          Deeper: {},
        }
      });

      expect(config.getConfig()).toEqual({
        accessCode: 444444,
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "asdasd",
            otherKey: "123123",
          }
        },
        wins: 213,
      });
    });
  });

  describe("A config with some env links", () => {
    const config = new ConfigStore<ISimpleConfig>({
      accessCode: "123abc",
      nullThing: null,
      SomeLibrary: {
        Deeper: {
          key: "asdasd",
          otherKey: "123123",
        }
      },
      wins: 213,
    });

    it("Should throw an error if env link set without defining the ENV", () => {
      expect(() => config.setEnvLinks({
        accessCode: {
          env: "ACCESS_CODE",
          type: ETypeOfEnvLink.STRING,
        },
      })).toThrowError();
    });

    it ("Should have a value overridden with an env variable if its set", () => {
      process.env.ACCESS_CODE = "123222";

      config.setEnvLinks({
        accessCode: {
          env: "ACCESS_CODE",
          type: ETypeOfEnvLink.NUMBER,
        }
      });

      expect(config.getEnvLinks()).toEqual({
        accessCode: 123222,
      });
    });

    it("Should ignore previous env configs if set again with the option to ignore", () => {
      process.env.ACCESS_CODE = "123222";

      config.setEnvLinks({
        accessCode: {
          env: "ACCESS_CODE",
          type: ETypeOfEnvLink.NUMBER,
        }
      });

      config.setEnvLinks({
        wins: {
          env: "WINS",
          type: ETypeOfEnvLink.NUMBER,
          required: false,
          defaultValue: 0,
        }
      }, true);

      expect(config.getEnvLinks()).toEqual({
        wins: 0,
      });
    });

    it("Should be able to set env config in deep objects", () => {
      process.env.SOME_LIBRARY_DEEPER_KEY = "dsadsa";

      config.setEnvLinks({
        SomeLibrary: {
          Deeper: {
            key: {
              type: ETypeOfEnvLink.STRING,
              env: "SOME_LIBRARY_DEEPER_KEY",
            }
          }
        },
        wins: {
          env: "WINS",
          type: ETypeOfEnvLink.NUMBER,
          required: false,
          defaultValue: 0,
        }
      });

      expect(config.getEnvLinks()).toEqual({
        wins: 0,
        SomeLibrary: {
          Deeper: {
            key: "dsadsa",
          }
        }
      });

      expect(config.getConfig({ ignoreOverrides: true })).toEqual({
        accessCode: "123abc",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "dsadsa",
            otherKey: "123123",
          }
        },
        wins: 0,
      });
    });
  });

  describe("A full test with both overides and links", () => {
    it("Should define both and return a different config depending on options", () => {
      process.env.CONFIG_OVERRIDE_ACCESS_CODE = "\"321cba\"";
      process.env.CONFIG_OVERRIDE_SOME_LIBRARY__DEEPER__KEY = "\"dsadsa\"";
      process.env.WINS = "12345";

      const config = new ConfigStore<ISimpleConfig>({
        accessCode: "123abc",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "asdasd",
            otherKey: "123123",
          }
        },
        wins: 213,
      });

      config.setEnvLinks({
        wins: {
          type: ETypeOfEnvLink.NUMBER,
          env: "WINS",
        },
      });

      expect(config.getOverrides()).toEqual({
        accessCode: "321cba",
        SomeLibrary: {
          Deeper: {
            key: "dsadsa",
          },
        }
      });

      expect(config.getEnvLinks()).toEqual({
        wins: 12345,
      });

      expect(config.getConfig({ ignoreOverrides: true, ignoreEnvLinks: true })).toEqual({
        accessCode: "123abc",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "asdasd",
            otherKey: "123123",
          }
        },
        wins: 213,
      });

      expect(config.getConfig({ ignoreOverrides: true })).toEqual({
        accessCode: "123abc",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "asdasd",
            otherKey: "123123",
          }
        },
        wins: 12345,
      });

      expect(config.getConfig({ ignoreEnvLinks: true })).toEqual({
        accessCode: "321cba",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "dsadsa",
            otherKey: "123123",
          }
        },
        wins: 213,
      });
    })
  });

  describe("Configuration reactions", () => {
    it("Should react and change values in proper order", () => {
      const config = new ConfigStore<ISimpleConfig>({
        accessCode: "321cba",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "dsadsa",
            otherKey: "123123",
          }
        },
        wins: 213,
      }, `SOMETHING_ELSE`, `Test Config`);

      config.addConfigChangeReaction((c) => {
        c.nullThing = true;
      });

      expect(config.getConfig().nullThing).toEqual(true);
    });

    it("Should react to changes in the config and set new values accordingly", () => {
      const config = new ConfigStore<ISimpleConfig>({
        accessCode: "321cba",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "dsadsa",
            otherKey: "123123",
          }
        },
        wins: 213,
      });

      config.addConfigChangeReaction((c) => {
        c.SomeLibrary.Deeper.key = "ROCK";
      });

      expect(config.getConfig()).toEqual({
        accessCode: "321cba",
        nullThing: null,
        SomeLibrary: {
          Deeper: {
            key: "ROCK",
            otherKey: "123123",
          }
        },
        wins: 213,
      });

      config.addConfigChangeReaction((c) => {
        c.nullThing = c.SomeLibrary.Deeper.key === "ROCK" ? "notnull" : "incorrect";
      });

      expect(config.getConfig()).toEqual({
        accessCode: "321cba",
        nullThing: "notnull",
        SomeLibrary: {
          Deeper: {
            key: "ROCK",
            otherKey: "123123",
          }
        },
        wins: 213,
      });

      config.setConfig({
        wins: 3210,
      });

      expect(config.getConfig()).toEqual({
        accessCode: "321cba",
        nullThing: "notnull",
        SomeLibrary: {
          Deeper: {
            key: "ROCK",
            otherKey: "123123",
          }
        },
        wins: 3210,
      })
    });
  })
});
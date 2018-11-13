import immer from "immer";
import { snakeCase } from "lodash";
import { merge } from "lodash";

const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isString(value) {
  return {}.toString.call(value) === "[object String]";
}

function isSerializedDate(value) {
  return isString(value) && value.length > 15 && value.length < 30 && datePattern.test(value);
}

function reviveDateObjects(key, value) {
  if (isSerializedDate(value)) {
    return new Date(value);
  }

  return value;
}

function getOverridesFromEnv<T extends object>(prefix: string, obj: T): T {
  const overrideObj: object = {};

  for (const key of Object.keys(obj)) {
    const overrideKey = `${prefix}${snakeCase(key).toUpperCase()}`;

    if (obj[key] != null && typeof obj[key] === "object") {
      overrideObj[key] = getOverridesFromEnv(`${overrideKey}__`, obj[key]);
    } else {
      if (typeof process.env[overrideKey] !== "undefined" && process.env[overrideKey] != null) {
        overrideObj[key] = JSON.parse(
          process.env[overrideKey]!,
          reviveDateObjects
        );
      }
    }
  }

  return overrideObj as T;
}

export enum ETypeOfEnvLink {
  STRING = "STRING",
  NUMBER = "NUMBER",
  JSON_STRING = "JSON_STRING",
}

interface IEnvironmentLink {
  env: string;
  type: ETypeOfEnvLink;
  required?: boolean;
  defaultValue?: any;
}

type DeepPartial<T, F = undefined> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : F extends undefined ? T[P] : F };
// type TEnvironmentLinks<T extends object> = { [property in keyof Partial<T>]: T[property] extends object ? TEnvironmentLinks<T[property]> : IEnvironmentLink };
type TEnvironmentLinks<T extends object> = any;

function isEnvLink(obj: any): obj is IEnvironmentLink {
  const keyLength = Object.keys(obj).length;

  if (obj.hasOwnProperty("env") && obj.hasOwnProperty("type")) {
    if (keyLength > 2) {
      if ((obj.hasOwnProperty("required") || obj.hasOwnProperty("defaultValue")) && keyLength <= 4) {
        if (keyLength === 3) {
          return true;
        } else if (obj.hasOwnProperty("required") && obj.hasOwnProperty("defaultValue")) {
          return true;
        }
      }
    } else {
      return true;
    }
  }

  return false;
}

function getEnvLinksFromEnv<T extends object>(envLinks: TEnvironmentLinks<T>, configName: string): T {
  const envLinksObj: object = {};

  const configNameString = configName.length > 0 ? ` (${configName})` : "";

  for (const key of Object.keys(envLinks)) {
    const cur: IEnvironmentLink | TEnvironmentLinks<any> = envLinks[key];

    if (isEnvLink(cur)) {
      const { type, env, defaultValue, required = true }: IEnvironmentLink = cur;

      if (typeof process.env[env] === "undefined") {
        if (required) {
          throw new Error(
            `CONFIG${configNameString}: Couldn't get the REQUIRED environment variable [${env}] - you must define it. (alternatively set the link to not-required and provide a default)`
          );
        }

        if (typeof defaultValue === "undefined") {
          throw new Error(
            `CONFIG${configNameString}: default value for pulling environment variable [${env}] is undefined (an environment variable that is not required must have a default value)`
          );
        }

        console.warn(`CONFIG${configNameString}: property '${key}' using default value (${JSON.stringify(defaultValue)}) because env variable "${env}" was not set.`);

        envLinksObj[key] = defaultValue;
      } else {
        const envString: string = process.env[env]!;
        let value;

        if (type === ETypeOfEnvLink.JSON_STRING) {
          value = JSON.parse(envString, reviveDateObjects);
        } else if (type === ETypeOfEnvLink.NUMBER) {
          value = Number(envString);
        } else {
          value = envString;
        }

        envLinksObj[key] = value;
      }
    } else {
      envLinksObj[key] = getEnvLinksFromEnv(cur, configName);
    }
  }

  return envLinksObj as T;
}

export type TConfigChangeReaction<T = any> = (config: T) => void;

export class ConfigStore<T extends object> {
  private _values: T;
  private _valuesWithAugmentations: T;
  private _overridePrefix: string;
  private readonly _configName: string;
  private _envOverrides: Partial<T> = {};
  private _envLinks: Partial<T> = {};
  private _configChangeReactions: Array<TConfigChangeReaction<any>> = [];

  constructor(initialValues: T, envOverridePrefix: string = "CONFIG_OVERRIDE_", configName = "") {
    this._configName = configName;
    this._values = initialValues;
    this.setEnvOverridePrefix(envOverridePrefix);
  }

  setEnvOverridePrefix(envOverridePrefix: string) {
    this._overridePrefix = envOverridePrefix;
    try {
      this._envOverrides = getOverridesFromEnv(envOverridePrefix, this._values);
    } catch (e) {
      console.error(
        `Your configuration overrides ( prefix: ${envOverridePrefix} ) need to be JSON parsable - you need to escape string double quotes \\"`
      );
      throw e;
    }

    this.finalizeValues();
  }

  setEnvLinks(envLinks: TEnvironmentLinks<T>, ignorePrevious = false) {
    if (ignorePrevious) {
      this._envLinks = {};
    }

    this._envLinks = merge({}, this._envLinks, getEnvLinksFromEnv(envLinks, this._configName));
    this.finalizeValues();
  }

  addConfigChangeReaction(configChangeReaction: TConfigChangeReaction<T>) {
    this._configChangeReactions.push(configChangeReaction);
    this.finalizeValues();
  }

  setConfig(config: DeepPartial<T>, envOverridePrefix = this._overridePrefix) {
    this._values = merge({}, this._values, config);
    this.setEnvOverridePrefix(envOverridePrefix);

    console.log(`Should have set values`, config);
  }

  getConfig({ ignoreOverrides = false, ignoreEnvLinks = false, ignoreReactions = false } = {}): T {
    if (ignoreOverrides || ignoreEnvLinks || ignoreReactions) {
      let returnValues: T = merge({}, this._values);

      if (!ignoreEnvLinks) {
        returnValues = merge(returnValues, this._envLinks);
      }

      if (!ignoreOverrides) {
        returnValues = merge(returnValues, this._envOverrides);
      }

      if (!ignoreReactions) {
        for (const changeReaction of this._configChangeReactions) {
          returnValues = immer(returnValues, changeReaction);
        }
      }

      return returnValues;
    }

    return this._valuesWithAugmentations;
  }

  getEnvLinks(): Partial<T> {
    return this._envLinks;
  }

  getOverrides(): Partial<T> {
    return this._envOverrides;
  }

  private finalizeValues() {
    this._valuesWithAugmentations = merge({}, this._values, this._envLinks, this._envOverrides);

    for (const changeReaction of this._configChangeReactions) {
      this._valuesWithAugmentations = immer(this._valuesWithAugmentations, changeReaction);
    }
  }
}

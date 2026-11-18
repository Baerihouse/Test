import {
  createModel,
  modelSchema,
  parseBackup,
  type BuildingModel,
} from "../../../entities/building-model/model/model"

export function storageKey(userId: string) {
  return `woomi:model-settings:v1:${encodeURIComponent(userId)}:201-floor2-84a-expanded`
}

export function loadModel(storage: Pick<Storage, "getItem">, key: string): BuildingModel {
  const value = storage.getItem(key)
  return value === null ? createModel() : parseBackup(value)
}

export function saveModel(storage: Pick<Storage, "setItem">, key: string, model: BuildingModel) {
  storage.setItem(key, JSON.stringify(modelSchema.parse(model)))
}

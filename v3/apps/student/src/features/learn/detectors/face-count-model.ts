import type * as tf from '@tensorflow/tfjs-core';

export interface FaceCountModelFiles {
  /** The model's model.json. */
  model: ArrayBuffer;
  /** Its one weights file. */
  weights: ArrayBuffer;
}

/** A tfjs model loader over files already in memory. */
export function modelFromFiles({ model, weights }: FaceCountModelFiles): tf.io.IOHandler {
  const json = JSON.parse(new TextDecoder().decode(model)) as tf.io.ModelJSON;
  return {
    load: async () => ({
      modelTopology: json.modelTopology,
      format: json.format,
      generatedBy: json.generatedBy,
      convertedBy: json.convertedBy,
      signature: json.signature,
      userDefinedMetadata: json.userDefinedMetadata,
      weightSpecs: json.weightsManifest.flatMap((group) => group.weights),
      weightData: weights,
    }),
  };
}

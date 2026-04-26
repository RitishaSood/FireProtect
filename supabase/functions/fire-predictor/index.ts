import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import modelData from "./rf_model.json" with { type: "json" };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Class mapping: 0 = actual_fire, 1 = false_alarm, 2 = no_fire
const CLASS_MAP: Record<number, 'true_fire' | 'false_alarm' | 'no_fire'> = {
  0: 'true_fire',
  1: 'false_alarm',
  2: 'no_fire',
};

interface TreeNode {
  f?: number;
  t?: number;
  l?: TreeNode;
  r?: TreeNode;
  leaf?: number[];
}

// StandardScaler: z = (x - mean) / std
const SCALER_MEAN = (modelData as any).scaler?.mean ?? [1000, 60, 33, 0.5, 0.5];
const SCALER_STD = (modelData as any).scaler?.std ?? [700, 15, 8, 0.5, 0.5];

function scaleFeatures(features: number[]): number[] {
  return features.map((val, i) => (val - SCALER_MEAN[i]) / SCALER_STD[i]);
}

function predictTree(node: TreeNode, features: number[]): number[] {
  if (node.leaf) return node.leaf;
  if (features[node.f!] <= node.t!) {
    return predictTree(node.l!, features);
  }
  return predictTree(node.r!, features);
}

function predictForest(rawFeatures: number[]): { prediction: string; confidence: number; probabilities: number[] } {
  // Apply StandardScaler before prediction
  const features = scaleFeatures(rawFeatures);
  
  const nClasses = modelData.n_classes;
  const votes = new Array(nClasses).fill(0);

  for (const tree of modelData.trees) {
    const leafVotes = predictTree(tree as TreeNode, features);
    const total = leafVotes.reduce((a, b) => a + b, 0);
    for (let i = 0; i < nClasses; i++) {
      votes[i] += leafVotes[i] / total;
    }
  }

  const totalVotes = votes.reduce((a: number, b: number) => a + b, 0);
  const probabilities = votes.map((v: number) => v / totalVotes);
  const bestClass = probabilities.indexOf(Math.max(...probabilities));
  
  return {
    prediction: CLASS_MAP[modelData.classes[bestClass]] || 'no_fire',
    confidence: probabilities[bestClass],
    probabilities,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gas, flame, temperature, humidity, pir } = await req.json();

    console.log('[Fire Predictor] Input:', { gas, flame, temperature, humidity, pir });

    if (gas == null || flame == null || temperature == null) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required sensor values (gas, flame, temperature)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Feature order must match training data: GAS, HUMIDITY, TEMPERATURE, PIR, FLAME
    const features = [
      Number(gas),
      Number(humidity ?? 0),
      Number(temperature),
      Number(pir ?? 0),
      Number(flame === 'FLAME' || flame === 1 || flame === '1' ? 1 : 0),
    ];

    const result = predictForest(features);

    console.log('[Fire Predictor] Scaled features:', scaleFeatures(features));
    console.log('[Fire Predictor] Result:', result);

    return new Response(
      JSON.stringify({
        success: true,
        prediction: result.prediction,
        confidence: Math.round(result.confidence * 100) / 100,
        probabilities: {
          true_fire: Math.round(result.probabilities[0] * 100) / 100,
          false_alarm: Math.round(result.probabilities[1] * 100) / 100,
          no_fire: Math.round(result.probabilities[2] * 100) / 100,
        },
        model: 'random_forest_v1',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Fire Predictor] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

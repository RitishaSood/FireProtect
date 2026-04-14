import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Fire Predictor Edge Function
 * 
 * Accepts sensor data and returns a prediction: true_fire, false_alarm, or no_fire.
 * 
 * Currently uses rule-based logic as a placeholder.
 * Will be replaced with ML model inference when the .pkl model is provided.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gas, flame, temperature, humidity, pir } = await req.json();

    console.log('[Fire Predictor] Input:', { gas, flame, temperature, humidity, pir });

    // Validate input
    if (gas == null || flame == null || temperature == null) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required sensor values (gas, flame, temperature)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- PLACEHOLDER: Rule-based prediction ---
    // This will be replaced with actual ML model inference (.pkl) later.
    
    let prediction: 'true_fire' | 'false_alarm' | 'no_fire';
    let confidence: number;

    const flameDetected = flame === 1 || flame === '1' || flame === 'FLAME';
    const highGas = Number(gas) > 1000;
    const highTemp = Number(temperature) > 40;

    if (flameDetected && (highGas || highTemp)) {
      // Strong indicators of real fire
      prediction = 'true_fire';
      confidence = 0.92;
    } else if (flameDetected && !highGas && !highTemp) {
      // Flame sensor triggered but no supporting evidence
      prediction = 'false_alarm';
      confidence = 0.75;
    } else if (!flameDetected && (highGas || highTemp)) {
      // No flame but elevated readings - could be pre-fire or environmental
      prediction = 'false_alarm';
      confidence = 0.60;
    } else {
      // All normal
      prediction = 'no_fire';
      confidence = 0.95;
    }

    console.log('[Fire Predictor] Result:', { prediction, confidence });

    return new Response(
      JSON.stringify({
        success: true,
        prediction,
        confidence,
        model: 'rule_based_v1', // Will change to 'ml_model_v1' when pkl is integrated
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

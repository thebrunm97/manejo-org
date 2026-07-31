-- Create rag_experiment_evaluations table
CREATE TABLE public.rag_experiment_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.rag_experiment_runs(id) ON DELETE CASCADE,
    
    -- Execution State
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, success, error
    
    -- Judge Metadata
    judge_model_id TEXT,
    judge_prompt_version TEXT,
    judge_schema_version TEXT,
    
    -- Evaluation Scores (0-1)
    faithfulness_score NUMERIC CHECK (faithfulness_score >= 0 AND faithfulness_score <= 1),
    answer_relevance_score NUMERIC CHECK (answer_relevance_score >= 0 AND answer_relevance_score <= 1),
    context_relevance_score NUMERIC CHECK (context_relevance_score >= 0 AND context_relevance_score <= 1), -- For future phase
    confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Qualitative Evaluation
    verdict TEXT CHECK (verdict IN ('pass', 'warning', 'fail')),
    reasoning_short TEXT,
    unsupported_claims JSONB,
    missing_points JSONB,
    
    -- Error Handling
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    evaluated_at TIMESTAMP WITH TIME ZONE
);

-- Triggers for updated_at
CREATE TRIGGER set_rag_experiment_evaluations_updated_at
BEFORE UPDATE ON public.rag_experiment_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- RLS (Admin Only)
ALTER TABLE public.rag_experiment_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view and manage rag_experiment_evaluations"
ON public.rag_experiment_evaluations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

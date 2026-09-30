-- Admin-managed agent workflows, task assignments, and schedules.

CREATE TABLE IF NOT EXISTS public.ai_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.ai_workflows(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position > 0),
  instruction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_id, position)
);

CREATE TABLE IF NOT EXISTS public.ai_task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.ai_workflows(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.ai_workflow_steps(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  assignee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  due_at TIMESTAMPTZ,
  schedule_id UUID,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_workflow_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.ai_workflows(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekdays', 'weekly')),
  weekday SMALLINT CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  time_of_day TIME NOT NULL,
  timezone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (frequency = 'weekly' AND weekday IS NOT NULL)
    OR (frequency <> 'weekly' AND weekday IS NULL)
  )
);

ALTER TABLE public.ai_task_assignments
  DROP CONSTRAINT IF EXISTS ai_task_assignments_schedule_id_fkey;
ALTER TABLE public.ai_task_assignments
  ADD CONSTRAINT ai_task_assignments_schedule_id_fkey
  FOREIGN KEY (schedule_id) REFERENCES public.ai_workflow_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_workflow_steps_workflow ON public.ai_workflow_steps(workflow_id, position);
CREATE INDEX IF NOT EXISTS idx_ai_task_assignments_assignee ON public.ai_task_assignments(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_task_assignments_workflow ON public.ai_task_assignments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_schedules_due ON public.ai_workflow_schedules(next_run_at) WHERE is_active = true;

ALTER TABLE public.ai_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflow_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage agent workflows" ON public.ai_workflows;
CREATE POLICY "Staff manage agent workflows"
  ON public.ai_workflows FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Staff manage workflow steps" ON public.ai_workflow_steps;
CREATE POLICY "Staff manage workflow steps"
  ON public.ai_workflow_steps FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Staff manage task assignments" ON public.ai_task_assignments;
CREATE POLICY "Staff manage task assignments"
  ON public.ai_task_assignments FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Staff manage workflow schedules" ON public.ai_workflow_schedules;
CREATE POLICY "Staff manage workflow schedules"
  ON public.ai_workflow_schedules FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP TRIGGER IF EXISTS update_ai_workflows_updated_at ON public.ai_workflows;
CREATE TRIGGER update_ai_workflows_updated_at
  BEFORE UPDATE ON public.ai_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_workflow_steps_updated_at ON public.ai_workflow_steps;
CREATE TRIGGER update_ai_workflow_steps_updated_at
  BEFORE UPDATE ON public.ai_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_task_assignments_updated_at ON public.ai_task_assignments;
CREATE TRIGGER update_ai_task_assignments_updated_at
  BEFORE UPDATE ON public.ai_task_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_workflow_schedules_updated_at ON public.ai_workflow_schedules;
CREATE TRIGGER update_ai_workflow_schedules_updated_at
  BEFORE UPDATE ON public.ai_workflow_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

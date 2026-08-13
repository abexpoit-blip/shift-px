-- Create broadcasts table
CREATE TABLE public.broadcasts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'sparkles',
    tone TEXT NOT NULL DEFAULT 'premium' CHECK (tone IN ('info', 'success', 'warning', 'premium')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);

-- Create broadcast_reads table
CREATE TABLE public.broadcast_reads (
    broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (broadcast_id, user_id)
);

-- Grant permissions
GRANT SELECT ON public.broadcasts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO service_role;
GRANT ALL ON public.broadcast_reads TO authenticated;
GRANT ALL ON public.broadcast_reads TO service_role;

-- Enable RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

-- Policies for broadcasts
CREATE POLICY "Users can see active broadcasts" ON public.broadcasts
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Admins can manage broadcasts" ON public.broadcasts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policies for broadcast_reads
CREATE POLICY "Users can see their own reads" ON public.broadcast_reads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reads" ON public.broadcast_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reads" ON public.broadcast_reads
    FOR UPDATE USING (auth.uid() = user_id);

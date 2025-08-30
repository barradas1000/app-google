-- Script para criar a tabela active_conductors no Supabase
-- Execute este script no editor SQL do seu projeto Supabase

CREATE TABLE IF NOT EXISTS public.active_conductors (
    conductor_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'offline' CHECK (status IN ('offline', 'available', 'busy')),
    session_start TIMESTAMP WITH TIME ZONE,
    session_end TIMESTAMP WITH TIME ZONE,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar comentários às colunas
COMMENT ON TABLE public.active_conductors IS 'Tabela para rastrear condutores ativos e suas localizações';
COMMENT ON COLUMN public.active_conductors.conductor_id IS 'ID do utilizador (referência à tabela auth.users)';
COMMENT ON COLUMN public.active_conductors.current_latitude IS 'Latitude atual do condutor';
COMMENT ON COLUMN public.active_conductors.current_longitude IS 'Longitude atual do condutor';
COMMENT ON COLUMN public.active_conductors.accuracy IS 'Precisão da localização em metros';
COMMENT ON COLUMN public.active_conductors.last_ping IS 'Última atualização de localização';
COMMENT ON COLUMN public.active_conductors.is_active IS 'Indica se o condutor está ativo';
COMMENT ON COLUMN public.active_conductors.status IS 'Status do condutor (offline, available, busy)';
COMMENT ON COLUMN public.active_conductors.session_start IS 'Início da sessão de trabalho';
COMMENT ON COLUMN public.active_conductors.session_end IS 'Fim da sessão de trabalho';
COMMENT ON COLUMN public.active_conductors.name IS 'Nome do condutor';

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_active_conductors_is_active ON public.active_conductors(is_active);
CREATE INDEX IF NOT EXISTS idx_active_conductors_status ON public.active_conductors(status);
CREATE INDEX IF NOT EXISTS idx_active_conductors_last_ping ON public.active_conductors(last_ping);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_active_conductors_updated_at
    BEFORE UPDATE ON public.active_conductors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (Row Level Security) - Opcional mas recomendado
ALTER TABLE public.active_conductors ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança (ajuste conforme necessário)
CREATE POLICY "Utilizadores podem ver apenas seus próprios dados" 
    ON public.active_conductors FOR SELECT 
    USING (auth.uid() = conductor_id);

CREATE POLICY "Utilizadores podem inserir seus próprios dados" 
    ON public.active_conductors FOR INSERT 
    WITH CHECK (auth.uid() = conductor_id);

CREATE POLICY "Utilizadores podem atualizar seus próprios dados" 
    ON public.active_conductors FOR UPDATE 
    USING (auth.uid() = conductor_id);

CREATE POLICY "Utilizadores podem deletar seus próprios dados" 
    ON public.active_conductors FOR DELETE 
    USING (auth.uid() = conductor_id);

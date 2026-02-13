-- Migration: Fix RLS Infinite Recursion
-- Date: 2026-01-24
-- Description: Recreates is_admin() with SECURITY DEFINER and splits policies to avoid recursive checks.

-- 1. Derruba a função antiga para garantir
DROP FUNCTION IF EXISTS public.is_admin();

-- 2. Recria com SECURITY DEFINER (A Chave Mestra)
-- This ensures the query runs with the privileges of the function creator (superuser),
-- bypassing RLS on the 'profiles' table within the function itself.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ajusta a Policy de Leitura de Perfis (Evita checar admin para si mesmo)
-- We explicitly separate "view own" from "admin view all" to simplify evaluation.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Simple direct check for own profile (No recursion risk)
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING ( auth.uid() = id );

-- Admin check for other profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING ( public.is_admin() );

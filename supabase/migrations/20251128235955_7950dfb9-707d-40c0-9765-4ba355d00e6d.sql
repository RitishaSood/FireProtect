-- Add policy for authority users to manage locations
CREATE POLICY "Authority users can manage locations" 
ON public.locations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.user_type = 'authority'
  )
);

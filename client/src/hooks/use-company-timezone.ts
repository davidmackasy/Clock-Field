import { useQuery } from '@tanstack/react-query';
export function useCompanyTimezone() {
 const {data} = useQuery<{timezone:string}>({queryKey:['/api/settings/timezone']});
 return data?.timezone || 'UTC';
}

import type {
  BloodRequestRecord,
  HospitalPatientNeedListResponse,
  PatientNeedRecord,
  HospitalPatientNeedQuery,
} from '@bloodlink/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/api/client';
import { hospitalPatientNeedApi } from './api';

function toClientError(error: unknown): ApiClientError {
  return error instanceof ApiClientError
    ? error
    : new ApiClientError(0, 'MALFORMED', 'Unexpected error');
}

export function useHospitalPatientNeeds(query?: HospitalPatientNeedQuery) {
  const [state, setState] = useState<{
    data: HospitalPatientNeedListResponse | null;
    loading: boolean;
    error: ApiClientError | null;
  }>({ data: null, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await hospitalPatientNeedApi.list({
        page: query?.page,
        pageSize: query?.pageSize,
        status: query?.status,
      });
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: toClientError(error) });
    }
  }, [query?.page, query?.pageSize, query?.status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useHospitalPatientNeed(id: string | undefined) {
  const [state, setState] = useState<{
    record: PatientNeedRecord | null;
    loading: boolean;
    error: ApiClientError | null;
  }>({ record: null, loading: Boolean(id), error: null });

  const reload = useCallback(async () => {
    if (!id) return;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response = await hospitalPatientNeedApi.get(id);
      setState({ record: response.data, loading: false, error: null });
    } catch (error) {
      setState({ record: null, loading: false, error: toClientError(error) });
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useVerifyHospitalPatientNeed() {
  const [state, setState] = useState<{
    verifying: boolean;
    result: {
      patientNeed: PatientNeedRecord;
      bloodRequest: BloodRequestRecord;
    } | null;
    error: ApiClientError | null;
  }>({ verifying: false, result: null, error: null });

  const verify = useCallback(async (id: string) => {
    setState({ verifying: true, result: null, error: null });
    try {
      const response = await hospitalPatientNeedApi.verify(id);
      setState({ verifying: false, result: response.data, error: null });
      return response.data;
    } catch (error) {
      setState({ verifying: false, result: null, error: toClientError(error) });
      return null;
    }
  }, []);

  return { ...state, verify };
}

export function useRejectHospitalPatientNeed() {
  const [state, setState] = useState<{
    rejecting: boolean;
    rejected: PatientNeedRecord | null;
    error: ApiClientError | null;
  }>({ rejecting: false, rejected: null, error: null });

  const reject = useCallback(async (id: string) => {
    setState({ rejecting: true, rejected: null, error: null });
    try {
      const response = await hospitalPatientNeedApi.reject(id);
      setState({ rejecting: false, rejected: response.data, error: null });
      return response.data;
    } catch (error) {
      setState({
        rejecting: false,
        rejected: null,
        error: toClientError(error),
      });
      return null;
    }
  }, []);

  return { ...state, reject };
}

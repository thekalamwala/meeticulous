import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { svcGetById } from '../../services/api';
import ServiceForm from './ServiceForm';

export default function EditService() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    svcGetById(id)
      .then(r => setService(r.data))
      .catch(() => setError('Service not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-16 text-gray-400">Loading…</div>;
  if (error)   return <div className="text-center py-16 text-gray-400">{error}</div>;

  return <ServiceForm initialData={service} serviceId={id} />;
}

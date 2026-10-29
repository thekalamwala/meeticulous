import { CheckCircle2, Video } from 'lucide-react';
import { Card, Button } from '../../components/dashboard/ui';

export default function KycSubmitted() {
  return (
    <Card className="flex flex-col items-center p-8 text-center">
      <CheckCircle2 className="mb-4 h-14 w-14 text-green-500" />
      <h2 className="mb-1 text-lg font-bold text-gray-900">Submitted for review</h2>
      <p className="mb-6 max-w-sm text-sm text-gray-500">
        Your KYC is under review. To fast-track approval, schedule a short video KYC call —
        payouts unlock once verified.
      </p>
      <a href="https://meeticulous.com/sndatarkar/booking/video-kyc-for-book-a-sloth" target="_blank" rel="noopener noreferrer" className="w-full max-w-xs">
        <Button size="lg" full><Video className="h-4 w-4" /> Schedule a Video KYC</Button>
      </a>
    </Card>
  );
}

import Reveal from '../../../components/home/Reveal';
import PricingCards from '../../../components/pricing/PricingCards';
export default function S09Pricing() {
  return (
    <div>
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl text-center">Simple pricing. <span className="text-primary">Zero commission.</span></h2></Reveal>
      <div className="mt-8 max-h-[65vh] overflow-y-auto"><PricingCards /></div>
    </div>
  );
}

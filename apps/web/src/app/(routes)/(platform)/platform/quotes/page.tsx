import QuotesForm from '@/app/_quotes/components/QuotesForm';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardDescription from '@/app/_ui/components/Card/CardDescription';
import CardProse from '@/app/_ui/components/Card/CardProse';
import CardTitle from '@/app/_ui/components/Card/CardTitle';

const QuotesPage = () => {
  return (
    <main className="container py-8 md:py-16">
      <Card className="w-full max-w-5xl mx-auto">
        <CardContent>
          <CardProse>
            <CardTitle>Price Quote</CardTitle>
            <CardDescription colorRole="muted">
              Please fill in the following information to generate a price
              quote.
            </CardDescription>
          </CardProse>
          <QuotesForm />
        </CardContent>
      </Card>
    </main>
  );
};

export default QuotesPage;

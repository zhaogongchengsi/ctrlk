
import PageContent from './views/PageContent';
import PageHeader from './views/PageHeader';
import PageWrapper from './views/PageWrapper';


export default function Page() {
	return (
    <PageWrapper>
      <PageHeader />
      <PageContent />
    </PageWrapper>
  );
}
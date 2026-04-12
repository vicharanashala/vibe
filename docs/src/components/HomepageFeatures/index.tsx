import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Image: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Active Learning, Not Passive Watching',
    Image: require('@site/static/img/home_one.png').default,
    description: (
      <>
        Online education often becomes a checkbox activity. 
        ViBe changes that. By weaving in spontaneous comprehension checks, reflections, and interactive nudges, we ensure learners stay engaged and involved — not just present.
      </>
    ),
  },
  {
    title: 'Trust Through Gentle Proctoring',
    Image: require('@site/static/img/home_two.png').default,
    description: (
      <>
        We believe in trust, not surveillance. ViBe includes respectful presence verification — like subtle camera prompts, gesture-based checks, and environment control — to uphold fairness in assessments while keeping students comfortable and in control.
      </>
    ),
  },
  {
    title: 'Guided by AI, Open to All',
    Image: require('@site/static/img/home_three.png').default,
    description: (
      <>
        From content creation to learner feedback, ViBe uses AI to support both educators and learners — helping create better materials, personalized checkpoints, and responsive progress tracking. 
        And because ViBe is open-source, everyone can contribute, access, and improve it freely.
      </>
    ),
  },
];

function Feature({title, Image, description}: FeatureItem): ReactNode {
  return (
    <div className={clsx('col col--4', styles.feature)}>
      <div className="text--center">
        <img src={Image} className={styles.featureImg} alt={title} style={{ width: '200px', height: 'auto' }}/>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((item, idx) => (
            <Feature key={idx} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

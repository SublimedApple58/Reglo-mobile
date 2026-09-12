import React, { useEffect } from 'react';
import { EvaluationItemSheet } from '../../../src/components/EvaluationItemSheet';
import { evaluationItemStore } from '../../../src/stores/evaluationItemStore';

export default function EvaluationItemRoute() {
  // Il seed vive quanto il foglio: si pulisce alla chiusura, non all'apertura
  // del successivo (altrimenti il foglio nasce vuoto).
  useEffect(() => () => evaluationItemStore.clear(), []);
  return <EvaluationItemSheet />;
}

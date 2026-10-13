import React from 'react';

import { FollowCarConflictSheet } from '../../../src/components/booking/FollowCarConflictSheet';

/** Form sheet che abbraccia il contenuto — 1-3 date in conflitto (il caso quasi sempre). */
export default function FollowCarConflictScreen() {
  return <FollowCarConflictSheet scrollable={false} />;
}

import React from 'react';

import { FollowCarConflictSheet } from '../../../src/components/booking/FollowCarConflictSheet';

/** Stesso foglio (FORM_SHEET) per 4+ date: ora scorre il form sheet stesso, la route resta per `followCarConflictPath`. */
export default function FollowCarConflictLongScreen() {
  return <FollowCarConflictSheet />;
}

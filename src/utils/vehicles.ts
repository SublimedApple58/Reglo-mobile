// Vehicle ↔ instructor usability — mirror of the backend pool/exclusivity model.
// A vehicle is usable by an instructor when it is exclusive to them, or it is
// open/in a pool that includes them. Mirrors the BE matcher and the local helper
// that lived in CreateGroupLessonScreen.

export const instructorCanUseVehicle = (
  v: { assignedInstructorId?: string | null; poolInstructorIds?: string[] | null },
  instructorId: string,
): boolean => {
  if (v.assignedInstructorId) return v.assignedInstructorId === instructorId;
  const pool = v.poolInstructorIds ?? [];
  return pool.length === 0 || pool.includes(instructorId);
};

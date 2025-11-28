export async function checkTimeStep() {
  "use step";
  return { time: new Date().toISOString() };
}

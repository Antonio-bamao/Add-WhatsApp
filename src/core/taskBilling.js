function selectNewlySentRows(progress, sentBeforeCount = 0) {
  const sent = progress && Array.isArray(progress.sent) ? progress.sent : [];
  const start = Math.max(0, Number(sentBeforeCount) || 0);
  return sent.slice(start).map(row => ({
    rowNumber: row.rowNumber,
    whatsappId: row.whatsappId
  }));
}

module.exports = {
  selectNewlySentRows
};

function test(arg) {
  if (arg < 0) {
    throw new Error('negative');
  }
  return new Promise((resolve, reject) => {
    if (arg === 0) {
      reject(new Error('zero'));
    } else {
      resolve('positive');
    }
  });
}

test(-1)
  .then(result => {
    console.log('ok', result);
  })
  .catch(err => {
    console.error('error', err.message);
  });

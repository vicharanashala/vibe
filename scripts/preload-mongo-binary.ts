import { MongoBinary } from 'mongodb-memory-server-core';
import { AnyOS, getOS, isLinuxOS } from 'mongodb-memory-server-core/lib/util/getos';
import { removeDir } from 'mongodb-memory-server-core/lib/util/utils';


(async () => {
  console.log("Mongo Binary Installed @", await MongoBinary.getPath());
})();

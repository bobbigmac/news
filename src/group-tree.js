// Shared allocator for curated grouping trees.
//
// The tree data decides which items may belong to a branch. This allocator only
// measures branch sizes, picks a readable level of detail, and claims each item
// once so a graph-like source can still render as a hierarchy.

function unique(items) {
  return [...new Set(items)];
}

export function allocateTreeGroups({
  roots,
  items,
  getNodeKeys,
  getItemWeight = () => 1,
  targetSize,
  minBranchSize = 1,
}) {
  const itemByKey = new Map(items.map(item => [item.key, item]));
  const claimed = new Set();
  const directKeyCache = new Map();
  const subtreeKeyCache = new Map();

  function directKeys(node) {
    if (!directKeyCache.has(node)) {
      directKeyCache.set(node, unique(getNodeKeys(node)).filter(key => itemByKey.has(key)));
    }
    return directKeyCache.get(node);
  }

  function allSubtreeKeys(node) {
    if (!subtreeKeyCache.has(node)) {
      subtreeKeyCache.set(node, unique([
        ...directKeys(node),
        ...(node.children || []).flatMap(allSubtreeKeys),
      ]));
    }
    return subtreeKeyCache.get(node);
  }

  function availableKeys(keys) {
    return keys.filter(key => !claimed.has(key));
  }

  function subtreeKeys(node) {
    return availableKeys(allSubtreeKeys(node));
  }

  function weight(keys) {
    return keys.reduce((sum, key) => sum + getItemWeight(itemByKey.get(key)), 0);
  }

  function emit(node, keys, path, isRemainder = false) {
    keys = availableKeys(keys);
    if (!keys.length) return null;
    keys.forEach(key => claimed.add(key));
    return {
      id: node.id,
      label: node.label,
      node,
      keys,
      items: keys.map(key => itemByKey.get(key)),
      weight: weight(keys),
      path,
      remainder: isRemainder,
    };
  }

  function choose(node, path) {
    const keys = subtreeKeys(node);
    const total = weight(keys);
    if (!total) return [];

    const children = node.children || [];
    if (total <= targetSize || !children.length) {
      const group = emit(node, keys, path);
      return group ? [group] : [];
    }

    const selected = [];
    const remainderKeys = [];
    for (const child of children) {
      const childKeys = subtreeKeys(child);
      const childTotal = weight(childKeys);
      if (!childTotal) continue;
      if (childTotal < minBranchSize) remainderKeys.push(...childKeys);
      else selected.push(...choose(child, [...path, child.label]));
    }

    remainderKeys.push(...availableKeys(getNodeKeys(node)));
    const remainderTotal = weight(remainderKeys);
    if (!selected.length) {
      const group = emit(node, keys, path);
      return group ? [group] : [];
    }
    if (remainderTotal) {
      const group = emit(
        { ...node, id: `${node.id}:other`, label: `${node.label} Other` },
        remainderKeys,
        [...path, 'Other'],
        true,
      );
      if (group) selected.push(group);
    }
    return selected;
  }

  const groups = [];
  for (const root of roots) {
    groups.push(...choose(root, [root.label]).map(group => ({
      ...group,
      rootId: root.id,
      rootLabel: root.label,
    })));
  }
  return { groups, claimed };
}

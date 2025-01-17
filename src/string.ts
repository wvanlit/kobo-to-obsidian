export function findCommonPrefix(chapters: string[]): string {
	let commonPrefix = chapters[0];
	for (const chapter of chapters) {
		let i = 0;
		while (i < commonPrefix.length && commonPrefix[i] === chapter[i]) {
			i++;
		}
		commonPrefix = commonPrefix.slice(0, i);
	}
	return commonPrefix;
}

export function findCommonSuffix(chapters: string[]): string {
	let commonSuffix = chapters[0];
	for (const chapter of chapters) {
		let i = 0;
		while (
			i < commonSuffix.length &&
			commonSuffix[commonSuffix.length - 1 - i] ===
				chapter[chapter.length - 1 - i]
		) {
			i++;
		}
		commonSuffix = commonSuffix.slice(commonSuffix.length - i);
	}
	return commonSuffix;
}

type TreeNode = {
	prefix: string;
	items: string[];
};

/**
Turns a alphabetically sorted list like:

[
  "4.1", "4.2", "4.3",
  "5", "5.1", "5.2", "5.3",
  "6", "6.1", "6.2", "6.3"
]

into a list of items by common prefix

[
	{ prefix: "4.", items: ["4.1", "4.2", "4.3"] },
	{ prefix: "5",  items: ["5", "5.1", "5.2", "5.3"] },
	{ prefix: "6",  items: ["6", "6.1", "6.2", "6.3"] },
]

*/
export function groupByPrefix(list: string[]): TreeNode[] {
	const result: TreeNode[] = [];
	const todo = list.slice();

	let node: TreeNode | null = null;

	while (todo.length !== 0) {
		const currentItem = todo.shift()!;

		if (node === null) {
			node = {
				prefix: currentItem,
				items: [currentItem],
			};

			continue;
		}

		const commonPrefix = findCommonPrefix([currentItem, node.prefix]);
		const commonPrefixIsSubset = commonPrefix.startsWith(node.prefix);
		const prefixIsSubset = node.prefix.startsWith(commonPrefix);
		const addToNode = commonPrefix !== "" &&
			(commonPrefixIsSubset || prefixIsSubset);

		if (addToNode) {
			node.items.push(currentItem);
			node.prefix = findCommonPrefix([node.prefix, commonPrefix]);
		} else {
			result.push(node);
			todo.unshift(currentItem);
			node = null;
		}
	}

	if (node !== null) {
		result.push(node);
	}

	return result;
}
